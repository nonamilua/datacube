"""Create the phase 2 solve table."""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "solves",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("penalty", sa.String(), nullable=False),
        sa.CheckConstraint("duration_ms >= 0", name="ck_solve_duration"),
        sa.CheckConstraint("penalty IN ('OK', '+2', 'DNF')", name="ck_solve_penalty"),
    )
    op.create_index("ix_solves_started_at", "solves", ["started_at"])


def downgrade():
    op.drop_index("ix_solves_started_at", table_name="solves")
    op.drop_table("solves")
