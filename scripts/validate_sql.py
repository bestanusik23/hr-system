import sqlite3, io, sys

con = sqlite3.connect(":memory:")
con.execute("PRAGMA foreign_keys=ON;")
for f in ["migrations/0001_init.sql", "migrations/0002_seed.sql"]:
    sql = io.open(f, "r", encoding="utf-8").read()
    try:
        con.executescript(sql)
        print(f"OK  {f}")
    except Exception as e:
        print(f"ERR {f}: {e}")
        sys.exit(1)

# sanity counts
for t in ["divisions","departments","eval_topics","role_module_access"]:
    n = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    print(f"  {t:24} = {n}")

# FK integrity check
bad = con.execute("PRAGMA foreign_key_check").fetchall()
print("foreign_key_check issues:", len(bad))
if bad:
    print(bad[:10]); sys.exit(1)

# view works?
rows = con.execute("SELECT * FROM v_emp_status_by_division").fetchall()
print("v_emp_status_by_division rows:", len(rows))

# role matrix shape
roles = con.execute("SELECT DISTINCT role FROM role_module_access ORDER BY role").fetchall()
print("roles in matrix:", [r[0] for r in roles])
print("ALL SQL VALID")
