# bitespeed-backend-identity-reconciliation

# Identity Reconciliation API

A backend service that links customer records belonging to the same person. Customers often check out with a different email or phone number each time. This API connects those records into one identity, so every order can be traced back to a single customer.

Built for the Bitespeed backend task with Node.js, Express and MySQL.

## How it works

Each record in the `Contact` table is either **primary** (the oldest record for a person) or **secondary** (linked to a primary through `linkedId`).

When `POST /identify` receives an email, a phone number or both:

1. **No match:** create a new primary contact.
2. **Match with new information:** if the email or phone number is new, create a secondary contact linked to the existing primary.
3. **Two separate identities turn out to be one person:** if the request matches two different primary contacts, the older one stays primary. The newer one becomes a secondary contact linked to it.
4. **Response:** return the consolidated identity: the primary ID, all emails, all phone numbers and the IDs of every secondary contact.

## API

### `POST /identify`

**Request** (send at least one field)

```json
{
  "email": "lorraine@hillvalley.edu",
  "phoneNumber": "123456"
}
```

**Response**

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

The field name `primaryContatctId` matches the spelling in the task specification.

**Errors**

| Status | When |
|---|---|
| 400 | Neither `email` nor `phoneNumber` is sent |
| 500 | Database error |

### `GET /`

A health check that queries the database and returns its current time.

## Example

| Request | What happens |
|---|---|
| `{ "email": "a@x.com", "phoneNumber": "111" }` | No match, so contact 1 is created as primary |
| `{ "email": "b@x.com", "phoneNumber": "111" }` | Phone matches contact 1 and the email is new, so contact 2 is created as secondary |
| `{ "email": "c@x.com", "phoneNumber": "222" }` | No match, so contact 3 is created as primary |
| `{ "email": "a@x.com", "phoneNumber": "222" }` | Matches primaries 1 and 3, so contact 3 becomes secondary to contact 1 |

## Tech stack

| Part | Built with |
|---|---|
| Runtime | Node.js (ES modules) |
| Framework | Express 5 |
| Database | MySQL, through `mysql2` |
| Config | dotenv |

## Project structure

```
src/
├── server.js                         Express app and health check
├── db.js                             MySQL connection
├── routes/identifyRoutes.js          POST /identify
└── controllers/indentifyController.js  reconciliation logic
```

## Run it locally

Requires Node.js and a MySQL database.

### 1. Create the table

```sql
CREATE TABLE Contact (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  phoneNumber    VARCHAR(255),
  email          VARCHAR(255),
  linkedId       INT NULL,
  linkPrecedence ENUM('primary', 'secondary') NOT NULL,
  createdAt      DATETIME NOT NULL,
  updatedAt      DATETIME NOT NULL,
  deletedAt      DATETIME NULL
);
```

### 2. Configure

Create a `.env` file in the project root:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=<your MySQL user>
DB_PASSWORD=<your MySQL password>
DB_NAME=<your database name>
PORT=3000
```

### 3. Start the server

```bash
npm install
node src/server.js
```

The API runs on `http://localhost:3000`. Try it:

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"a@x.com","phoneNumber":"111"}'
```

## What I'd improve next

- When a request matches only secondary contacts, look up their primary through `linkedId` before merging
- Run each request's queries in a database transaction, so two requests at the same time can't create duplicate primaries
- Add indexes on `email` and `phoneNumber`
- Add automated tests for each reconciliation case
