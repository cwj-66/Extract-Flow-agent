"""Service 层领域异常（由 router 转为 HTTP 状态码）。"""

from __future__ import annotations


class TaskNotFoundError(Exception):
    def __init__(self, task_id: str) -> None:
        self.task_id = task_id
        super().__init__(f"task not found: {task_id}")


class TaskStateError(Exception):
    def __init__(self, task_id: str, message: str) -> None:
        self.task_id = task_id
        self.message = message
        super().__init__(message)


class UploadValidationError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class BatchNotFoundError(Exception):
    def __init__(self, batch_id: str) -> None:
        self.batch_id = batch_id
        super().__init__(f"batch not found: {batch_id}")
