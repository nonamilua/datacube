"""Prevent reuse of an accepted registration challenge across workers."""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "registration_challenges",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_registration_challenges_expires_at", "registration_challenges", ["expires_at"])


def downgrade():
    op.drop_table("registration_challenges")
