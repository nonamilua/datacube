"""Add one optional categorical custom value per solve without altering existing data."""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("solves") as batch:
        batch.add_column(sa.Column("custom", sa.String(length=10), nullable=True))
        batch.create_check_constraint("ck_solve_custom_length", "custom IS NULL OR length(custom) <= 10")


def downgrade():
    with op.batch_alter_table("solves") as batch:
        batch.drop_constraint("ck_solve_custom_length", type_="check")
        batch.drop_column("custom")
