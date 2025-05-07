module.exports = {
    createUser: `INSERT INTO users (email, fio, password, position, company, activity_sphere, city, phone)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id, email, fio, position, company, activity_sphere, city, phone`,
    getUserByEmail: `SELECT * FROM users WHERE email = $1`
  };
