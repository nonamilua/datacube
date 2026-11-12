"""Give saved solves stable backup IDs, independent of destination row IDs."""
from uuid import uuid4

from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("solves", sa.Column("portable_id", sa.Uuid(), nullable=True))
    solves = sa.table("solves", sa.column("id", sa.Uuid()), sa.column("portable_id", sa.Uuid()))
    connection = op.get_bind()
    connection.execute(solves.update().values(portable_id=solves.c.id))
    # Existing deterministic import IDs can coincide across independent installations.
    version = sa.func.substr(sa.func.replace(sa.cast(solves.c.id, sa.String()), "-", ""), 13, 1)
    imported = connection.execute(sa.select(solves.c.id).where(version == "5")).scalars().all()
    if imported:
        connection.execute(
            solves.update().where(solves.c.id == sa.bindparam("row_id")).values(portable_id=sa.bindparam("backup_id")),
            [{"row_id": row_id, "backup_id": uuid4()} for row_id in imported],
        )
    with op.batch_alter_table("solves") as batch:
        batch.alter_column("portable_id", existing_type=sa.Uuid(), nullable=False)
        batch.create_index("uq_solves_user_portable", ["user_id", "portable_id"], unique=True)


def downgrade():
    with op.batch_alter_table("solves") as batch:
        batch.drop_index("uq_solves_user_portable")
        batch.drop_column("portable_id")
