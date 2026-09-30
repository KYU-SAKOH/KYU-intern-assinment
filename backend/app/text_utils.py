"""
文字列まわりの小さな共通関数

SQL の LIKE 検索で使うパターン組み立てなど、
main.py と triage.py で同じ処理を二重に書かないための置き場。
"""


def like_pattern(keyword: str) -> str:
    """
    部分一致用の LIKE パターンを作る。
    % と _ はエスケープし、前後に % を付けて「含む」検索にする。
    """
    escaped = keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"
