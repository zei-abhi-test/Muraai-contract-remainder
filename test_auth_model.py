#!/usr/bin/env python3
"""Test script for User model authentication functionality."""

import sys
from datetime import datetime
from src.models.user import User, db
from flask import Flask

# Create a test Flask app context
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
db.init_app(app)

with app.app_context():
    # Create tables
    db.create_all()
    
    print("Testing User Model Authentication Features")
    print("=" * 50)
    
    # Test 1: Create user and set password
    print("\nTest 1: Create user and set password")
    user = User(username='testuser', email='test@example.com')
    user.set_password('securepassword123')
    db.session.add(user)
    db.session.commit()
    print(f"✓ User created: {user}")
    print(f"✓ Password hash stored: {user.password_hash[:20]}...")
    
    # Test 2: Verify password hash is not plain text
    print("\nTest 2: Verify password hash is not plain text")
    assert user.password_hash != 'securepassword123', "Password should be hashed, not stored as plain text"
    print(f"✓ Password is properly hashed (not plain text)")
    
    # Test 3: Check password with correct password
    print("\nTest 3: Check password with correct password")
    is_correct = user.check_password('securepassword123')
    assert is_correct is True, "check_password should return True for correct password"
    print(f"✓ check_password('securepassword123') returned True")
    
    # Test 4: Check password with incorrect password
    print("\nTest 4: Check password with incorrect password")
    is_wrong = user.check_password('wrongpassword')
    assert is_wrong is False, "check_password should return False for wrong password"
    print(f"✓ check_password('wrongpassword') returned False")
    
    # Test 5: Verify timestamps are set
    print("\nTest 5: Verify timestamps are set")
    assert user.created_at is not None, "created_at should be set"
    assert user.updated_at is not None, "updated_at should be set"
    assert isinstance(user.created_at, datetime), "created_at should be datetime"
    assert isinstance(user.updated_at, datetime), "updated_at should be datetime"
    print(f"✓ created_at: {user.created_at.isoformat()}")
    print(f"✓ updated_at: {user.updated_at.isoformat()}")
    
    # Test 6: Verify to_dict() does not include password_hash
    print("\nTest 6: Verify to_dict() excludes password_hash")
    user_dict = user.to_dict()
    assert 'password_hash' not in user_dict, "to_dict() should not include password_hash"
    assert 'id' in user_dict, "to_dict() should include id"
    assert 'username' in user_dict, "to_dict() should include username"
    assert 'email' in user_dict, "to_dict() should include email"
    assert 'created_at' in user_dict, "to_dict() should include created_at"
    assert 'updated_at' in user_dict, "to_dict() should include updated_at"
    print(f"✓ to_dict() output: {user_dict}")
    print(f"✓ password_hash is NOT in the output (secure)")
    
    # Test 7: Verify password hash is stored as string
    print("\nTest 7: Verify password hash is stored as string")
    assert isinstance(user.password_hash, str), "password_hash should be stored as string"
    print(f"✓ password_hash is a string: {type(user.password_hash)}")
    
    print("\n" + "=" * 50)
    print("All tests passed! ✓")
    print("=" * 50)
