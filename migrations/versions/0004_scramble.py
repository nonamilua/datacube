"""Preserve optional scramble notation on each solve."""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("solves") as batch:
        batch.add_column(sa.Column("scramble", sa.Text(), nullable=True))
        batch.create_check_constraint("ck_solve_scramble_length", "scramble IS NULL OR length(scramble) <= 4096")


def downgrade():
    with op.batch_alter_table("solves") as batch:
        batch.drop_constraint("ck_solve_scramble_length", type_="check")
        batch.drop_column("scramble")
