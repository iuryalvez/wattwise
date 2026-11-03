"""Expected failures shared by validation, integrations, and HTTP handlers."""


class AppError(ValueError):
    def __init__(self, message, *, code, status, field=None):
        super().__init__(message)
        self.code, self.status, self.field = code, status, field

    def as_dict(self):
        result = {"error": str(self), "code": self.code}
        if self.field is not None:
            result["field"] = self.field
        return result


class InputError(AppError):
    def __init__(self, message, field):
        super().__init__(message, code="invalid_input", status=400, field=field)
