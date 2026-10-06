# Admin dashboard setup

This admin app runs separately from the main task manager client.

## Start the backend

```bash
cd server
npm install
node index.js
```

## Start the main app

```bash
cd client
npm install
npm run dev
```

## Start the admin app

```bash
cd admin
npm install
npm run dev
```

Open the admin app at:

- http://localhost:5174

## Admin access

Only accounts with the role `admin` can access the admin dashboard.

Use one of these methods:

1. Firestore user document:

```js
{
  uid: "USER_ID",
  role: "admin"
}
```

2. Firebase custom claim:

```js
admin.auth().setCustomUserClaims(uid, { role: "admin" });
```

After that, sign in to the app with the admin account and the admin dashboard will load its overview data from the protected `/admin/overview` route.
