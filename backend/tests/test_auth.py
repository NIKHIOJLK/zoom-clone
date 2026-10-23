from conftest import DEMO, unique_email


def test_me_requires_login(client):
    assert client.get("/api/users/me").status_code == 401


def test_demo_login_returns_token_for_me(client, host_headers):
    me = client.get("/api/users/me", headers=host_headers)
    assert me.status_code == 200
    assert me.json()["email"] == DEMO["email"]


def test_login_email_is_case_insensitive(client):
    res = client.post("/api/auth/login", json={**DEMO, "email": DEMO["email"].upper()})
    assert res.status_code == 200


def test_wrong_password_and_unknown_email_look_the_same(client):
    wrong = client.post("/api/auth/login", json={**DEMO, "password": "nope"})
    unknown = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "nope"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()  # emails can't be probed


def test_signup_then_login(client):
    email = unique_email()
    res = client.post("/api/auth/signup", json={"name": "Asha", "email": email, "password": "longenough"})
    assert res.status_code == 201
    assert res.json()["user"]["name"] == "Asha"
    assert client.post("/api/auth/login", json={"email": email, "password": "longenough"}).status_code == 200


def test_signup_rejects_duplicate_email(client):
    email = unique_email()
    body = {"name": "Asha", "email": email, "password": "longenough"}
    assert client.post("/api/auth/signup", json=body).status_code == 201
    assert client.post("/api/auth/signup", json=body).status_code == 409


def test_signup_validates_input(client):
    assert client.post("/api/auth/signup", json={"name": "A", "email": unique_email(), "password": "short"}).status_code == 422
    assert client.post("/api/auth/signup", json={"name": "A", "email": "not-an-email", "password": "longenough"}).status_code == 422
    assert client.post("/api/auth/signup", json={"name": "   ", "email": unique_email(), "password": "longenough"}).status_code == 422


def test_forged_login_token_is_rejected(client):
    assert client.get("/api/users/me", headers={"Authorization": "Bearer not.a.real.token"}).status_code == 401
