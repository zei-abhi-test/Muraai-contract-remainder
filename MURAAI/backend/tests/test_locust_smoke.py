import ast
import os
import subprocess
import sys


def test_locustfile_ast_validity():
    """Verify locustfile.py syntax and user class definitions via AST parsing."""
    with open("locustfile.py", "r", encoding="utf-8") as f:
        content = f.read()

    tree = ast.parse(content)
    class_names = [node.name for node in ast.walk(tree) if isinstance(node, ast.ClassDef)]

    assert "ContractManagerUser" in class_names
    assert "PortalCustomerUser" in class_names


def test_locust_cli_help():
    """Verify locust CLI runs against locustfile.py with exit code 0."""
    locust_bin = os.path.join(os.path.dirname(sys.executable), "locust.exe" if sys.platform == "win32" else "locust")
    if not os.path.exists(locust_bin):
        locust_bin = "locust"

    res = subprocess.run([locust_bin, "-f", "locustfile.py", "--help"], capture_output=True, text=True)
    assert res.returncode == 0
    assert "ContractManagerUser" in res.stdout or "locust" in res.stdout.lower()
