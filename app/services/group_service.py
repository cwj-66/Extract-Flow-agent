"""飞书群配置持久化。"""

from __future__ import annotations

from sqlalchemy import delete, select

from app.api.schemas.config import GroupConfig, GroupsConfigResponse
from app.db.models import GroupConfigRow
from app.db.session import get_session_factory
from app.services.store import utcnow


class GroupService:
    def __init__(self, session_factory=None) -> None:
        self._session_factory = session_factory or get_session_factory()

    def get(self, group_id: str) -> GroupConfig | None:
        with self._session_factory() as session:
            row = session.get(GroupConfigRow, group_id)
            if row is None:
                return None
            return GroupConfig(
                id=row.id,
                name=row.name,
                webhook_url=row.webhook_url,
                document_type=row.document_type,
                is_default=row.is_default,
            )

    def get_default(self) -> GroupConfig | None:
        groups = self.list_groups().groups
        for g in groups:
            if g.is_default and g.webhook_url.strip():
                return g
        for g in groups:
            if g.webhook_url.strip():
                return g
        return None

    def list_groups(self) -> GroupsConfigResponse:
        with self._session_factory() as session:
            rows = session.scalars(
                select(GroupConfigRow).order_by(GroupConfigRow.created_at.asc())
            ).all()
            return GroupsConfigResponse(
                groups=[
                    GroupConfig(
                        id=r.id,
                        name=r.name,
                        webhook_url=r.webhook_url,
                        document_type=r.document_type,
                        is_default=r.is_default,
                    )
                    for r in rows
                ]
            )

    def replace_groups(self, groups: list[GroupConfig]) -> GroupsConfigResponse:
        now = utcnow()
        with self._session_factory() as session:
            session.execute(delete(GroupConfigRow))
            for g in groups:
                session.add(
                    GroupConfigRow(
                        id=g.id,
                        name=g.name,
                        webhook_url=g.webhook_url,
                        document_type=g.document_type,
                        is_default=g.is_default,
                        created_at=now,
                        updated_at=now,
                    )
                )
            session.commit()
        return GroupsConfigResponse(groups=groups)
