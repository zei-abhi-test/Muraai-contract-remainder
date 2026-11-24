import pyotp
import pytest
from tests.conftest import register_user


def test_2fa_setup_verify_login_and_disable_flow(client):
    """Full end-to-end test of TOTP 2FA setup, activation, 2-step login, and disabling."""

    # 1. Register a test user
    user, token = register_user(client, username="twofa_user", email="twofa@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Call /api/auth/2fa/setup
    setup_resp = client.post("/api/auth/2fa/setup", headers=headers)
    assert setup_resp.status_code == 200
    setup_data = setup_resp.get_json()

    assert "secret" in setup_data
    assert "otpauth_url" in setup_data
    assert "qr_code" in setup_data
    assert setup_data["qr_code"].startswith("data:image/png;base64,")

    secret = setup_data["secret"]

    # 3. Call /api/auth/2fa/verify with invalid code
    bad_verify = client.post("/api/auth/2fa/verify", headers=headers, json={"code": "000000"})
    assert bad_verify.status_code == 400

    # Verify with correct code
    totp = pyotp.TOTP(secret)
    valid_code = totp.now()
    verify_resp = client.post("/api/auth/2fa/verify", headers=headers, json={"code": valid_code})
    assert verify_resp.status_code == 200
    assert "Two-factor authentication enabled" in verify_resp.get_json()["message"]

    # 4. Attempt login — should return 2FA challenge
    login_resp = client.post("/api/auth/login", json={"email": "twofa@example.com", "password": "securepassword123"})
    assert login_resp.status_code == 200
    login_data = login_resp.get_json()
    assert login_data.get("requires_2fa") is True
    assert "pre_auth_token" in login_data

    pre_auth_token = login_data["pre_auth_token"]

    # 5. Authenticate 2FA challenge with invalid code
    bad_auth = client.post("/api/auth/2fa/authenticate", json={"pre_auth_token": pre_auth_token, "code": "999999"})
    assert bad_auth.status_code == 401

    # Authenticate 2FA challenge with valid code
    auth_resp = client.post("/api/auth/2fa/authenticate", json={"pre_auth_token": pre_auth_token, "code": totp.now()})
    assert auth_resp.status_code == 200
    auth_data = auth_resp.get_json()
    assert "token" in auth_data
    assert auth_data["user"]["email"] == "twofa@example.com"

    # 6. Disable 2FA
    new_headers = {"Authorization": f"Bearer {auth_data['token']}"}
    disable_resp = client.post(
        "/api/auth/2fa/disable",
        headers=new_headers,
        json={"password": "securepassword123", "code": totp.now()},
    )
    assert disable_resp.status_code == 200

    # 7. Verify standard login works without 2FA challenge
    normal_login = client.post("/api/auth/login", json={"email": "twofa@example.com", "password": "securepassword123"})
    assert normal_login.status_code == 200
    assert "token" in normal_login.get_json()
    assert "requires_2fa" not in normal_login.get_json()
