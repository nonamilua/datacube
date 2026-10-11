"""Keep optional catalog identity on owned cubes while preserving solve links."""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    # Adding columns first avoids rebuilding a table referenced by solves on SQLite.
    op.add_column("cubes", sa.Column("catalog_event", sa.String(), nullable=True))
    op.add_column("cubes", sa.Column("catalog_model_id", sa.String(), nullable=True))
    rebuild(True)


def change_constraint(upgrading):
    with op.batch_alter_table("cubes") as batch:
        if upgrading:
            batch.drop_constraint("uq_cube_user_name", type_="unique")
            batch.create_unique_constraint("uq_cube_user_model_name", ["user_id", "name", "catalog_event", "catalog_model_id"])
        else:
            batch.drop_constraint("uq_cube_user_model_name", type_="unique")
            batch.create_unique_constraint("uq_cube_user_name", ["user_id", "name"])
            batch.drop_column("catalog_model_id")
            batch.drop_column("catalog_event")


def rebuild(upgrading):
    connection = op.get_bind()
    if connection.dialect.name != "sqlite":
        change_constraint(upgrading)
        return
    # SQLite cannot replace a referenced table while FK enforcement is enabled.
    # PRAGMA must run outside a transaction; restore enforcement even on failure.
    with op.get_context().autocommit_block():
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        try:
            change_constraint(upgrading)
            if connection.exec_driver_sql("PRAGMA foreign_key_check").fetchall():
                raise RuntimeError("cube migration left invalid foreign keys")
        finally:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")


def downgrade():
    # Duplicate handles across model identities must be renamed before downgrade.
    rebuild(False)
