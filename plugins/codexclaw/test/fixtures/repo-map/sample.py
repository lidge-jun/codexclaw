class DeltaStore:
    def __init__(self):
        self.items = {}

    def put(self, key, value):
        self.items[key] = value


def gamma_helper(key):
    store = DeltaStore()
    store.put(key, True)
    return key
