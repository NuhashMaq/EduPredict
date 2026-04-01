from __future__ import annotations

import pytest


async def _login(client, *, email: str, password: str) -> dict:
    res = await client.post(
        "/auth/login",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert res.status_code == 200
    return res.json()


@pytest.mark.anyio
async def test_admin_can_list_and_update_users(client):
    # Bootstrap admin
    await client.post(
        "/bootstrap/admin",
        json={
            "bootstrap_token": "test-bootstrap-token-12345",
            "email": "admin3@example.com",
            "password": "AdminSuperSecure123",
            "full_name": "Admin Three",
        },
    )
    admin_tokens = await _login(client, email="admin3@example.com", password="AdminSuperSecure123")

    # Create a teacher
    res = await client.post(
        "/admin/users",
        json={
            "email": "teacher3@example.com",
            "full_name": "Teacher Three",
            "role": "teacher",
            "password": "AnotherSuperSecure123",
        },
        headers={"Authorization": f"Bearer {admin_tokens['access_token']}"},
    )
    assert res.status_code == 201
    teacher = res.json()

    # List users
    res = await client.get(
        "/admin/users",
        headers={"Authorization": f"Bearer {admin_tokens['access_token']}"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["total"] >= 2

    # Update user (deactivate)
    res = await client.patch(
        f"/admin/users/{teacher['id']}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {admin_tokens['access_token']}"},
    )
    assert res.status_code == 200
    assert res.json()["is_active"] is False


@pytest.mark.anyio
async def test_admin_can_delete_user(client):
    # Bootstrap admin
    await client.post(
        "/bootstrap/admin",
        json={
            "bootstrap_token": "test-bootstrap-token-12345",
            "email": "admin4@example.com",
            "password": "AdminSuperSecure123",
            "full_name": "Admin Four",
        },
    )
    admin_tokens = await _login(client, email="admin4@example.com", password="AdminSuperSecure123")

    # Create a student
    res = await client.post(
        "/admin/users",
        json={
            "email": "student4@example.com",
            "full_name": "Student Four",
            "role": "student",
            "password": "StudentSuperSecure123",
        },
        headers={"Authorization": f"Bearer {admin_tokens['access_token']}"},
    )
    assert res.status_code == 201
    student = res.json()

    # Delete user
    res = await client.delete(
        f"/admin/users/{student['id']}",
        headers={"Authorization": f"Bearer {admin_tokens['access_token']}"},
    )
    assert res.status_code == 204

    # Ensure not returned in list
    res = await client.get(
        "/admin/users?q=student4@example.com",
        headers={"Authorization": f"Bearer {admin_tokens['access_token']}"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 0
