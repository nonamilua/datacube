"""Allow twelve-character custom tags without changing existing values."""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("solves") as batch:
        batch.drop_constraint("ck_solve_custom_length", type_="check")
        batch.alter_column("custom", existing_type=sa.String(length=10), type_=sa.String(length=12), existing_nullable=True)
        batch.create_check_constraint("ck_solve_custom_length", "custom IS NULL OR length(custom) <= 12")


def downgrade():
    # Rows longer than ten characters must be edited before downgrading.
    # The tighter check intentionally refuses to truncate stored tags.
    with op.batch_alter_table("solves") as batch:
        batch.drop_constraint("ck_solve_custom_length", type_="check")
        batch.alter_column("custom", existing_type=sa.String(length=12), type_=sa.String(length=10), existing_nullable=True)
        batch.create_check_constraint("ck_solve_custom_length", "custom IS NULL OR length(custom) <= 10")
