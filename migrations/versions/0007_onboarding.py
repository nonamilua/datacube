"""Existing accounts skip onboarding; new accounts start unacknowledged."""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("users", sa.Column("onboarding_acknowledged", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.execute(sa.text("UPDATE users SET onboarding_acknowledged = true"))

def downgrade():
    op.drop_column("users", "onboarding_acknowledged")
