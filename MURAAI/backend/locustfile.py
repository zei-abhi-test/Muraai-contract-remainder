import random
from locust import HttpUser, task, between


class ContractManagerUser(HttpUser):
    """Simulates a logged-in admin / contract manager using core backend APIs."""
    weight = 4
    wait_time = between(1, 3)

    def on_start(self):
        """Authenticate user on start up."""
        self.username = f"loadtest_{random.randint(1000, 9999)}"
        self.email = f"{self.username}@example.com"
        self.password = "LoadTestPass123!"

        # Register user
        reg_resp = self.client.post(
            "/api/auth/register",
            json={
                "username": self.username,
                "email": self.email,
                "password": self.password,
            },
            name="/api/auth/register",
        )

        if reg_resp.status_code == 201 and "token" in reg_resp.json():
            token = reg_resp.json()["token"]
        else:
            # Login if user exists
            login_resp = self.client.post(
                "/api/auth/login",
                json={"email": self.email, "password": self.password},
                name="/api/auth/login",
            )
            token = login_resp.json().get("token", "")

        self.headers = {"Authorization": f"Bearer {token}"}

    @task(5)
    def get_dashboard_summary(self):
        """Fetch dashboard summary (benchmarks Redis/SimpleCache aggregation speed)."""
        self.client.get("/api/dashboard/data", headers=self.headers, name="/api/dashboard/data")

    @task(4)
    def list_contracts_paginated(self):
        """Fetch paginated contracts list (benchmarks database index performance)."""
        page = random.randint(1, 3)
        self.client.get(
            f"/api/contracts?page={page}&per_page=20",
            headers=self.headers,
            name="/api/contracts?page=[page]&per_page=20",
        )

    @task(3)
    def list_invoices_paginated(self):
        """Fetch paginated invoices list."""
        page = random.randint(1, 3)
        self.client.get(
            f"/api/invoices?page={page}&per_page=20",
            headers=self.headers,
            name="/api/invoices?page=[page]&per_page=20",
        )

    @task(2)
    def list_customers(self):
        """Fetch customer list."""
        self.client.get("/api/customers", headers=self.headers, name="/api/customers")

    @task(1)
    def search_query(self):
        """Perform search query."""
        keywords = ["contract", "invoice", "test", "active"]
        q = random.choice(keywords)
        self.client.get(f"/api/search?q={q}", headers=self.headers, name="/api/search?q=[q]")


class PortalCustomerUser(HttpUser):
    """Simulates a customer accessing the public Customer Portal APIs."""
    weight = 1
    wait_time = between(1, 4)

    def on_start(self):
        """Authenticate portal customer."""
        self.email = "portal_demo@example.com"
        self.password = "PortalPass123!"

        resp = self.client.post(
            "/api/portal/auth/login",
            json={"email": self.email, "password": self.password},
            name="/api/portal/auth/login",
        )
        if resp.status_code == 200 and "token" in resp.json():
            token = resp.json()["token"]
            self.headers = {"Authorization": f"Bearer {token}"}
        else:
            self.headers = {}

    @task(3)
    def get_portal_dashboard(self):
        """Fetch customer portal dashboard."""
        if self.headers:
            self.client.get("/api/portal/dashboard", headers=self.headers, name="/api/portal/dashboard")

    @task(3)
    def get_portal_contracts(self):
        """Fetch customer portal contracts list."""
        if self.headers:
            self.client.get("/api/portal/contracts", headers=self.headers, name="/api/portal/contracts")

    @task(2)
    def get_portal_invoices(self):
        """Fetch customer portal invoices list."""
        if self.headers:
            self.client.get("/api/portal/invoices", headers=self.headers, name="/api/portal/invoices")
