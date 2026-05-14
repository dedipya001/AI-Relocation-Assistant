from bson import ObjectId


def to_jsonable(doc: dict) -> dict:
    output = dict(doc)
    for key, value in output.items():
        if isinstance(value, ObjectId):
            output[key] = str(value)
    return output
