from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import bcrypt

db = SQLAlchemy()


class User(db.Model):
    """User model for authentication and contract management."""

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def __repr__(self):
        return f"<User {self.username}>"

    def set_password(self, password: str) -> None:
        """Hash and store the user's password using bcrypt.

        Args:
            password: Plain text password to hash and store
        """
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        self.password_hash = hashed.decode("utf-8")

    def check_password(self, password: str) -> bool:
        """Verify a plain text password against the stored hash.

        Args:
            password: Plain text password to verify

        Returns:
            True if password matches the hash, False otherwise
        """
        return bcrypt.checkpw(password.encode("utf-8"), self.password_hash.encode("utf-8"))

    def to_dict(self):
        """Convert user to dictionary representation (excludes password_hash for security).

        Returns:
            Dictionary with user id, username, email, and timestamps
        """
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
