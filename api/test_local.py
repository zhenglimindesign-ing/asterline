"""Local test for the pipeline API — NOT a Vercel deployment test.
Run: python api/test_local.py
"""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from api.pipeline import run_pipeline

test_items = [
    "Your app crashed three times today when I tried to upload a file. Each time I lost everything I'd typed. Please fix this.",
    "Would love a dark mode option for the dashboard. Late night reconciliation sessions are rough on the eyes.",
    "Setup was smooth, KYB took maybe 15 minutes. Way less painful than other fintech tools I've tried.",
]

print(f"Testing pipeline with {len(test_items)} items...\n")

try:
    result = run_pipeline(test_items)
    print(f"Success! {result['meta']['clusters_formed']} clusters formed from {result['meta']['items_processed']} items.\n")
    for wp in result["clusters"]:
        print(f"  {wp.get('cluster_id', '?')} — {wp.get('title', '(no title)')}")
        print(f"    intent: {wp.get('intent_type')} | signal: {wp.get('signal_strength')}")
        print(f"    members: {wp.get('cluster_members')}")
        if wp.get("review_flags"):
            print(f"    review_flags: {len(wp['review_flags'])}")
        print()

    print("Full JSON output:")
    print(json.dumps(result, indent=2, ensure_ascii=False)[:3000])
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
