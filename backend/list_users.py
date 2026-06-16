from app.dependencies import get_db
from app.models import User
db = next(get_db())
users = db.query(User).all()
for u in users:
    print(u.id, u.email, u.role, u.client_id)
