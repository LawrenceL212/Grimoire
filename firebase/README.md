# Firestore rules for Grimoire cloud sync

`firestore.rules` is the complete rules file: the existing `users`, `progress` and `sessions` blocks plus the new
`games/{uid}` block that cloud sync uses. Only the signed-in owner can read or write their own `games/{uid}`
document, and a write may only contain the keys `schema`, `updatedAt` and `siso`.

To publish them (project `grimoire-250ad`):

1. Open the Firebase console, project grimoire-250ad, then Firestore Database, then the Rules tab.
2. Replace everything in the editor with the contents of `firestore.rules`.
3. Press Publish.

Until they are published, sign-in works but saving to the cloud is refused; the game keeps working on the device and the
sync chip says it could not sync. Email/password sign-in must also be enabled under Authentication, Sign-in method (the
old Library already uses it).

The game and the old Library use the same Firebase project and the same persistence (browser local storage), so a
sign-in in one is shared by the other: one login for both.
