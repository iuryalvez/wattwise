"""Expected failures shared by validation, integrations, and HTTP handlers."""


class AppError(ValueError):
    def __init__(self, message, *, code, status, field=None, message_key=None, params=None):
        super().__init__(message)
        self.code, self.status, self.field = code, status, field
        self.message_key = message_key or f"errors.{code}"
        self.params = params or {}

    def as_dict(self):
        result = {"error": str(self), "code": self.code, "message_key": self.message_key}
        if self.params:
            result["params"] = self.params
        if self.field is not None:
            result["field"] = self.field
        return result


class InputError(AppError):
    def __init__(self, message, field, *, message_key=None, params=None):
        super().__init__(message, code="invalid_input", status=400, field=field,
                         message_key=message_key, params=params)
