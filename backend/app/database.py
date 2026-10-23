"""SQLAlchemy engine, session factory and the FastAPI DB dependency."""
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import DATABASE_URL

# check_same_thread=False: FastAPI may use the connection from a different thread.
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


@event.listens_for(engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, _):
    # SQLite ignores FOREIGN KEY constraints unless this pragma is on.
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def upgrade_schema() -> None:
    """Tiny hand-written migration for databases created before login existed.

    `create_all` only creates missing tables; it never adds columns to existing ones.
    A real project would use Alembic migrations for this.
    """
    columns = {c["name"] for c in inspect(engine).get_columns("users")}
    if "password_hash" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)"))


def get_db():
    """One session per request, always closed afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
