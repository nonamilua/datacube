"""Add accounts, server sessions, cubes, categories and solve ownership."""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_table("login_sessions",
        sa.Column("token_hash", sa.String(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_login_sessions_user_id", "login_sessions", ["user_id"])
    for table, constraint in (("cubes", "uq_cube_user_name"), ("categories", "uq_category_user_name")):
        op.create_table(table,
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.UniqueConstraint("user_id", "name", name=constraint))
        op.create_index(f"ix_{table}_user_id", table, ["user_id"])
    # Legacy phase 2 records remain unassigned until a local administrator imports them.
    with op.batch_alter_table("solves") as batch:
        batch.add_column(sa.Column("user_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("cube_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("category_id", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_solves_user", "users", ["user_id"], ["id"])
        batch.create_foreign_key("fk_solves_cube", "cubes", ["cube_id"], ["id"])
        batch.create_foreign_key("fk_solves_category", "categories", ["category_id"], ["id"])
        batch.create_index("ix_solves_user_id", ["user_id"])


def downgrade():
    with op.batch_alter_table("solves") as batch:
        batch.drop_index("ix_solves_user_id")
        for name in ("fk_solves_user", "fk_solves_cube", "fk_solves_category"):
            batch.drop_constraint(name, type_="foreignkey")
        for name in ("user_id", "cube_id", "category_id"):
            batch.drop_column(name)
    for table in ("categories", "cubes", "login_sessions", "users"):
        op.drop_table(table)
