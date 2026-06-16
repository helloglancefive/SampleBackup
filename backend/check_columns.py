from app.models import AdMetrics
cols = [c.name for c in AdMetrics.__table__.columns]
print(cols)
