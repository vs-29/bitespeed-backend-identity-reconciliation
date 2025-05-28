import db from '../db.js';

export const identifyUser = async (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'email or phoneNumber required' });
  }

  try {
    // 1. Fetch any contacts matching email or phoneNumber
    const [existing] = await db.promise().query(
      `SELECT * FROM Contact WHERE email = ? OR phoneNumber = ?`,
      [email, phoneNumber]
    );

    // 2. If none found → create a new primary and return
    if (existing.length === 0) {
      const [ins] = await db.promise().query(
        `INSERT INTO Contact (email, phoneNumber, linkPrecedence, createdAt, updatedAt)
         VALUES (?, ?, 'primary', NOW(), NOW())`,
        [email, phoneNumber]
      );
      return res.json({
        contact: {
          primaryContatctId: ins.insertId,
          emails: [email],
          phoneNumbers: [phoneNumber],
          secondaryContactIds: [],
        }
      });
    }

    // 3. Identify all primaries among those matches
    const primaries = existing.filter(c => c.linkPrecedence === 'primary');
    let primary = primaries[0];

    // 3a. If there's more than one primary, merge them:
    if (primaries.length > 1) {
      // pick the oldest as the true primary
      primary = primaries.reduce((oldest, c) =>
        new Date(c.createdAt) < new Date(oldest.createdAt) ? c : oldest
      );

      // downgrade all the other primaries
      for (let other of primaries) {
        if (other.id !== primary.id) {
          await db.promise().query(
            `UPDATE Contact
               SET linkedId = ?, linkPrecedence = 'secondary', updatedAt = NOW()
             WHERE id = ?`,
            [primary.id, other.id]
          );
        }
      }
    }

    // 4. Now pull in every contact linked to that primary (including itself)
    const [allRelated] = await db.promise().query(
      `SELECT * FROM Contact WHERE id = ? OR linkedId = ?`,
      [primary.id, primary.id]
    );

    // 5. If this request brings in new email or phone, add as secondary
    const gotEmail   = allRelated.some(c => c.email === email);
    const gotPhone   = allRelated.some(c => c.phoneNumber === phoneNumber);

    if ((email && !gotEmail) || (phoneNumber && !gotPhone)) {
      await db.promise().query(
        `INSERT INTO Contact (email, phoneNumber, linkedId, linkPrecedence, createdAt, updatedAt)
         VALUES (?, ?, ?, 'secondary', NOW(), NOW())`,
        [email, phoneNumber, primary.id]
      );
      // refresh list
      const [refreshed] = await db.promise().query(
        `SELECT * FROM Contact WHERE id = ? OR linkedId = ?`,
        [primary.id, primary.id]
      );
      allRelated.splice(0, allRelated.length, ...refreshed);
    }

    // 6. Build the response
    const emails   = [...new Set(allRelated.map(c => c.email).filter(Boolean))];
    const phones   = [...new Set(allRelated.map(c => c.phoneNumber).filter(Boolean))];
    const secondaries = allRelated
      .filter(c => c.linkPrecedence === 'secondary')
      .map(c => c.id);

    res.json({
      contact: {
        primaryContatctId: primary.id,
        emails,
        phoneNumbers: phones,
        secondaryContactIds: secondaries,
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
