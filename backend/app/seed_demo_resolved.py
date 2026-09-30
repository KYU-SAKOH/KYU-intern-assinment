"""
一度きり: 既存 samples / messages を全削除し、完全対応済みデモ 7 件を投入する。

実行例（backend コンテナ内）:
  uv run python seed_demo_resolved.py

ホストから（MySQL が localhost:3306 のとき）:
  set DATABASE_HOST=127.0.0.1
  uv run python seed_demo_resolved.py
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta

# コンテナ外実行向け: 未設定なら localhost を使う
os.environ.setdefault("DATABASE_HOST", "127.0.0.1")

from database import SessionLocal  # noqa: E402
from models import SampleMessageModel, SampleModel  # noqa: E402
from priority import score_from_sample_fields  # noqa: E402

DEMO_EMAIL = "demo-staff@example.com"


def _resolve_msg(cause: str, response: str, onsite: str) -> str:
    return (
        f"【原因】\n{cause}\n\n"
        f"【対応内容】\n{response}\n\n"
        f"【現場での解決方法】\n{onsite}"
    )


DEMOS: list[dict] = [
    {
        "name": "入場ゲート担当 A",
        "place": "メインゲート",
        "trouble_type": "customer",
        "expected": "QRコードをかざすとチケットが読み取れ入場できる",
        "actual": "何度かざしても「読み取れません」と表示され入場できない",
        "error_code": "QR-SCAN-01",
        "steps": [
            "ゲストの電子チケット画面を開いてもらう",
            "ゲート端末のカメラにQRを近づける",
            "画面に読み取り失敗と表示されるのを確認する",
            "別のゲストのQRでも同様か試す",
        ],
        "rate": "often",
        "severity": "high",
        "staff_body": "メインゲートでQRが読めず行列ができています。端末再起動も試しました。",
        "cause": "ゲート端末カメラレンズの汚れ・指紋によるフォーカス不良",
        "response": "遠隔でログを確認し、ハード異常ではなく光学面の汚れと判断。清掃手順を案内した。",
        "onsite": "レンズを乾いた布で軽く拭き、再スキャンして正常読取を確認する。改善しない場合は予備端末に切り替える。",
    },
    {
        "name": "ショップスタッフ B",
        "place": "フードコートPOS",
        "trouble_type": "stuff",
        "expected": "スタッフ端末でWi-Fi接続後にアプリへログインできる",
        "actual": "Wi-Fiが繰り返し切断され、ログイン画面でタイムアウトする",
        "error_code": "NET-TIMEOUT",
        "steps": [
            "端末のWi-Fi設定を開く",
            "園内APに接続を試みる",
            "接続後すぐに切断されることを確認する",
            "アプリのログインを試してタイムアウトを確認する",
        ],
        "rate": "always",
        "severity": "high",
        "staff_body": "フードコートのPOSがネットに繋がらず注文登録が止まりました。",
        "cause": "近傍アクセスポイントのハングによる断続的な切断",
        "response": "ネットワーク監視で対象APを特定し、遠隔再起動を実施。接続安定を確認した。",
        "onsite": "端末で対象SSIDに再接続し、ログインできることを確認。再発時は有線バックアップ回線へ切替。",
    },
    {
        "name": "チケット窓口 C",
        "place": "総合案内",
        "trouble_type": "customer",
        "expected": "有効期限内のチケットで入場処理ができる",
        "actual": "まだ有効なはずのチケットが「期限切れ」と表示される",
        "error_code": "TICKET-EXPIRED",
        "steps": [
            "ゲストのチケット日時を確認する",
            "端末のシステム日時を確認する",
            "チケットをスキャンして期限切れ表示を再現する",
            "別端末でも同じか確認する",
        ],
        "rate": "sometimes",
        "severity": "medium",
        "staff_body": "有効なはずのチケットが期限切れと出ます。ゲスト対応が滞っています。",
        "cause": "端末の日付・時刻が数日ずれていた（自動同期オフ）",
        "response": "端末の時刻設定を確認し、NTP同期を有効化。チケット検証ロジックは問題なしと判断。",
        "onsite": "設定から日時を自動同期にし、再スキャンして有効判定になることを確認する。",
    },
    {
        "name": "園内アプリ担当 D",
        "place": "スタッフ控室",
        "trouble_type": "stuff",
        "expected": "アプリを起動するとホーム画面が表示される",
        "actual": "起動直後にクラッシュし、ホームまで進めない",
        "error_code": "APP-CRASH",
        "steps": [
            "アプリアイコンをタップして起動する",
            "スプラッシュ表示後に強制終了することを確認する",
            "端末を再起動して再度起動を試す",
            "クラッシュが続くことを確認する",
        ],
        "rate": "always",
        "severity": "high",
        "staff_body": "スタッフ用アプリが起動直後に落ちます。業務に使えません。",
        "cause": "ローカルキャッシュ破損による起動時例外",
        "response": "クラッシュログを確認し、キャッシュクリア手順を案内。問題端末で復旧を確認した。",
        "onsite": "アプリのキャッシュを削除してから再起動し、ホーム画面まで進むことを確認する。",
    },
    {
        "name": "事務スタッフ E",
        "place": "バックヤード事務",
        "trouble_type": "stuff",
        "expected": "受付票をプリンタで印刷できる",
        "actual": "印刷ジョブがキューに残ったまま出ず、オフライン表示になる",
        "error_code": "PRT-OFFLINE",
        "steps": [
            "受付票の印刷ボタンを押す",
            "プリンタ状態がオフラインと表示されるのを確認する",
            "ケーブル接続を目視確認する",
            "別の書類でも印刷できないことを確認する",
        ],
        "rate": "often",
        "severity": "medium",
        "staff_body": "バックヤードのプリンタがオフラインで受付票が出せません。",
        "cause": "プリンタ電源オフ、またはUSBの接触不良",
        "response": "現場に電源・ケーブル確認を依頼。再接続後にテスト印刷で復旧を確認した。",
        "onsite": "電源とUSBを差し直し、テストページを印刷してから受付票を再出力する。",
    },
    {
        "name": "ゲート担当 F",
        "place": "サブゲート",
        "trouble_type": "customer",
        "expected": "バーコードを1回読み取ると入場完了になる",
        "actual": "連打や再かざしで二重読取になり、エラーや再入場扱いになる",
        "error_code": "BC-DUP",
        "steps": [
            "バーコードをかざして1回目の読取音を確認する",
            "すぐに再度かざす、またはボタンを連打する",
            "二重読取エラーが表示されることを確認する",
            "操作をゆっくりやり直して再現条件をメモする",
        ],
        "rate": "sometimes",
        "severity": "medium",
        "staff_body": "サブゲートでバーコードの二重読取が起き、ゲストが混乱しています。",
        "cause": "読取完了前の連打・再かざしによる操作ミス",
        "response": "二重読取ガードは正常動作。現場向けに「音が鳴るまで待って離す」手順を共有した。",
        "onsite": "1回読取後は端末から離し、成功音を確認してから次のゲストへ。連打しない。",
    },
    {
        "name": "ゲストサービス G",
        "place": "インフォメーション",
        "trouble_type": "customer",
        "expected": "ゲスト情報を開くと最新の予約内容が表示される",
        "actual": "昨日変更した予約内容が古いままで、同期されていない",
        "error_code": "SYNC-LAG",
        "steps": [
            "ゲスト検索で対象者を開く",
            "表示されている予約内容を確認する",
            "管理画面の最新内容と比較する",
            "画面を再読込しても古いことを確認する",
        ],
        "rate": "rare",
        "severity": "low",
        "staff_body": "インフォでゲスト情報が古く、変更後の予約が反映されていません。",
        "cause": "端末側キャッシュとサーバ同期の遅延",
        "response": "同期キューを確認し遅延を解消。端末での手動同期手順を案内した。",
        "onsite": "アプリの手動同期を実行し、画面を再読込して最新予約が表示されることを確認する。",
    },
]


def main() -> None:
    db = SessionLocal()
    try:
        deleted_msgs = db.query(SampleMessageModel).delete()
        deleted_samples = db.query(SampleModel).delete()
        db.commit()
        print(f"wiped messages={deleted_msgs}, samples={deleted_samples}")

        base = datetime.utcnow() - timedelta(days=14)
        for i, demo in enumerate(DEMOS):
            steps = demo["steps"]
            sample = SampleModel(
                name=demo["name"],
                date=base + timedelta(days=i, hours=10),
                place=demo["place"],
                trouble_type=demo["trouble_type"],
                trouble_detail="",
                expected_actions=demo["expected"],
                actual_actions=demo["actual"],
                error_code=demo["error_code"],
                ai_initial_response=(
                    "類似の完全対応済み事例を参考に、現場確認と再試行を案内してください。"
                ),
                email=DEMO_EMAIL,
                status="Fully Resolved",
                admin_comment=None,
                is_draft=False,
                reproduction_steps=json.dumps(steps, ensure_ascii=False),
                reproduction_rate=demo["rate"],
                severity=demo["severity"],
                screenshot_path=None,
                device_info="デモ投入データ",
            )
            sample.priority_score = score_from_sample_fields(
                expected_actions=sample.expected_actions,
                actual_actions=sample.actual_actions,
                error_code=sample.error_code,
                reproduction_steps_raw=steps,
                reproduction_rate=sample.reproduction_rate,
                severity=sample.severity,
                status=sample.status,
            )
            db.add(sample)
            db.flush()

            staff_msg = SampleMessageModel(
                sample_id=sample.id,
                author_role="staff",
                body=demo["staff_body"],
                created_at=sample.date + timedelta(minutes=5),
            )
            admin_msg = SampleMessageModel(
                sample_id=sample.id,
                author_role="admin",
                body=_resolve_msg(demo["cause"], demo["response"], demo["onsite"]),
                created_at=sample.date + timedelta(hours=2),
            )
            db.add(staff_msg)
            db.add(admin_msg)
            print(f"seeded #{sample.id} {sample.name} ({demo['error_code']})")

        db.commit()
        print(f"done: {len(DEMOS)} Fully Resolved demos")
    finally:
        db.close()


if __name__ == "__main__":
    main()
