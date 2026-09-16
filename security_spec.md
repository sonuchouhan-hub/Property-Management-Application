# Firestore Security Specification & TDD Test Plan

This document establishes the security invariants for the Dhanshri Properties database. These rules prevent privilege escalation, data poisoning, and unauthorized inventory manipulation.

## 1. Data Invariants

- **Users**: Users can only read and write their own profile document (`/users/{userId}`). No user can access or spoof another user's profile.
- **Projects**: Real estate project details are publicly readable, but write access (create, update, delete) is strictly restricted to administrative users.
- **Notifications**: Users can only read and write their own notification sub-collection (`/users/{userId}/notifications/{notificationId}`).
- **Bookings**: Bookings can be created by any authenticated user (submitting a booking requests) or admins, but they must contain valid project references. Once confirmed, booking statuses are terminal or restricted from unauthorized edits.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following payloads represent attempt types designed to violate the security of the application. The Firestore security rules are configured to reject all of these.

### P1: Identity Spoofing - Attacker writing another user's profile
- **Collection**: `users/attacker_uid` (Authenticated as `victim_uid`)
- **Payload**:
  ```json
  {
    "email": "victim@example.com",
    "mobile": "9999999999"
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (UID mismatch)

### P2: Privilege Escalation - Non-admin attempting to create a project
- **Collection**: `projects/new_project_id` (Authenticated as `non_admin_uid`)
- **Payload**:
  ```json
  {
    "id": 1234,
    "name": "Malicious Gated Township",
    "location": "Indore",
    "description": "Unauthorized listing",
    "imageUrls": ["https://malicious.com/fake.jpg"],
    "totalPlots": 50,
    "availablePlots": 50,
    "coords": { "lat": 22.0, "lng": 75.0 },
    "layout": [],
    "amenities": ["Unapproved Amenity"]
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (Admin check failed)

### P3: Data Poisoning - Inserting a 2MB base64 string in a text field
- **Collection**: `users/victim_uid` (Authenticated as `victim_uid`)
- **Payload**:
  ```json
  {
    "email": "victim@example.com",
    "mobile": "this_is_a_very_long_string_exceeding_standard_lengths_designed_to_bloat_storage..."
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (Field size limit exceeded)

### P4: Inventory State Hijack - Modifying plot statuses directly in projects without booking
- **Collection**: `projects/1` (Authenticated as `non_admin_uid`)
- **Payload**:
  ```json
  {
    "layout": [
      {
        "id": 1001,
        "number": "P-101",
        "size": 1200,
        "dimensions": "30x40",
        "facing": "East",
        "status": "Sold",
        "price": 1800000,
        "type": "Normal",
        "isMortgaged": false
      }
    ]
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (Write restriction on projects)

### P5: Unauthorized Notification Inspection - Reading another user's notifications
- **Collection**: `users/victim_uid/notifications/notif_123` (Authenticated as `attacker_uid`)
- **Expectation**: `PERMISSION_DENIED` (Sub-collection security)

### P6: Spoofed Timestamp Insertion - Setting a future/past date for bookings
- **Collection**: `bookings/bkg_999` (Authenticated as `victim_uid`)
- **Payload**:
  ```json
  {
    "bookingId": "bkg_999",
    "bookingDate": "2030-01-01T00:00:00.000Z",
    "status": "Confirmed"
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (Temporal verification mismatch)

### P7: Value Poisoning - Modifying booking statuses to Confirmed without token paid
- **Collection**: `bookings/bkg_123` (Authenticated as `non_admin_uid`)
- **Payload**:
  ```json
  {
    "bookingId": "bkg_123",
    "bookingAmount": 0,
    "status": "Confirmed"
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (Validation constraint)

### P8: Path Poisoning - Invalid ID Characters injection
- **Collection**: `users/user#invalid$char` (Authenticated as `user#invalid$char`)
- **Expectation**: `PERMISSION_DENIED` (Id format mismatch)

### P9: Shadow Update - Injecting arbitrary unlisted parameters
- **Collection**: `users/victim_uid` (Authenticated as `victim_uid`)
- **Payload**:
  ```json
  {
    "email": "victim@example.com",
    "isAdmin": true
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (Unrecognized parameter injection)

### P10: Query Scraping - Blanket user list reading
- **Collection**: `users` (Authenticated as `non_admin_uid` listing all profiles)
- **Expectation**: `PERMISSION_DENIED` (Blanket listing banned)

### P11: Orphaning Records - Booking a non-existent project
- **Collection**: `bookings/bkg_new` (Authenticated as `victim_uid`)
- **Payload**:
  ```json
  {
    "bookingId": "bkg_new",
    "projectId": 999999,
    "projectName": "Non-existent",
    "status": "Confirmed"
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (Project exists check)

### P12: Immutable Field Mutation - Attempting to alter original booking ID
- **Collection**: `bookings/bkg_123` (Authenticated as `victim_uid` changing original bookingId)
- **Payload**:
  ```json
  {
    "bookingId": "bkg_new_id"
  }
  ```
- **Expectation**: `PERMISSION_DENIED` (Immutable field check)

---

## 3. Test Cases Configuration

The validation runner verifies that each of these operations is caught at the database gate before executing any write or read operation.
