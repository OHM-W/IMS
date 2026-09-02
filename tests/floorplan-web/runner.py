#!/usr/bin/env python3
"""
IMS Industrial Real-time 2D Factory Digital Twin WebApp
Unified E2E Test Suite Runner

Usage:
  python tests/floorplan-web/runner.py [--tier {1,2,3,4,all}] [--verbose]

Exit Codes:
  0: 100% Tests Passed
  1: Test Failures or Errors Detected
"""

import sys
import os
import argparse
import unittest
import time
from typing import Dict, List, Any


# ANSI Color Codes for Terminal Output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


class ColorizedTestResult(unittest.TextTestResult):
    """Custom TestResult providing real-time colorized feedback."""

    def __init__(self, stream, descriptions, verbosity):
        super().__init__(stream, descriptions, verbosity)
        self.passed_count = 0

    def addSuccess(self, test):
        super().addSuccess(test)
        self.passed_count += 1
        if self.showAll:
            self.stream.write(f" {GREEN}[PASS]{RESET}\n")

    def addFailure(self, test, err):
        super().addFailure(test, err)
        if self.showAll:
            self.stream.write(f" {RED}[FAIL]{RESET}\n")

    def addError(self, test, err):
        super().addError(test, err)
        if self.showAll:
            self.stream.write(f" {RED}[ERROR]{RESET}\n")


class ColorizedTestRunner(unittest.TextTestRunner):
    """Custom TestRunner using ColorizedTestResult."""

    resultclass = ColorizedTestResult


def load_suite(tier: str = "all") -> unittest.TestSuite:
    """Load test suites based on tier filter."""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)

    import test_tier1_features
    import test_tier2_boundaries
    import test_tier3_combinations
    import test_tier4_workloads

    tier_map = {
        "1": [loader.loadTestsFromModule(test_tier1_features)],
        "2": [loader.loadTestsFromModule(test_tier2_boundaries)],
        "3": [loader.loadTestsFromModule(test_tier3_combinations)],
        "4": [loader.loadTestsFromModule(test_tier4_workloads)],
    }

    if tier == "all":
        for t in ["1", "2", "3", "4"]:
            for s in tier_map[t]:
                suite.addTests(s)
    elif tier in tier_map:
        for s in tier_map[tier]:
            suite.addTests(s)
    else:
        raise ValueError(f"Unknown tier: {tier}")

    return suite


def print_banner():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print(f"\n{CYAN}{BOLD}{'='*80}{RESET}")
    print(f"{CYAN}{BOLD}  IMS INDUSTRIAL 2D FACTORY DIGITAL TWIN -- E2E TEST SUITE RUNNER{RESET}")
    print(f"{CYAN}{BOLD}{'='*80}{RESET}\n")


def print_summary_table(results_by_tier: Dict[str, Dict[str, int]], total_elapsed: float):
    print(f"\n{BOLD}Test Execution Summary Table:{RESET}")
    print("-" * 75)
    print(f"{'Tier':<10} | {'Description':<35} | {'Tests':<8} | {'Status':<12}")
    print("-" * 75)

    descriptions = {
        "Tier 1": "Feature Coverage (F1..F18 >=5/ea)",
        "Tier 2": "Boundary & Corner Cases",
        "Tier 3": "Cross-Feature Combinations",
        "Tier 4": "Real-World Workload Scenarios",
    }

    total_runs = 0
    total_failures = 0
    total_errors = 0

    for tier_name, counts in results_by_tier.items():
        runs = counts["runs"]
        fails = counts["fails"]
        errs = counts["errs"]
        total_runs += runs
        total_failures += fails
        total_errors += errs

        desc = descriptions.get(tier_name, "Custom Tier")
        status_str = f"{GREEN}PASS (100%){RESET}" if (fails == 0 and errs == 0 and runs > 0) else f"{RED}FAIL ({fails+errs}){RESET}"
        print(f"{tier_name:<10} | {desc:<35} | {runs:<8} | {status_str}")

    print("-" * 75)
    overall_status = f"{GREEN}{BOLD}ALL TESTS PASSED{RESET}" if (total_failures == 0 and total_errors == 0) else f"{RED}{BOLD}FAILURES DETECTED{RESET}"
    print(f"{BOLD}Total Tests:{RESET} {total_runs:<5} | {BOLD}Failures:{RESET} {total_failures:<3} | {BOLD}Errors:{RESET} {total_errors:<3} | {BOLD}Duration:{RESET} {total_elapsed:.3f}s")
    print(f"{BOLD}Final Result:{RESET} {overall_status}\n")


def main():
    parser = argparse.ArgumentParser(description="IMS Floorplan Web E2E Test Suite Runner")
    parser.add_argument("--tier", choices=["1", "2", "3", "4", "all"], default="all", help="Test Tier to execute (default: all)")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")
    args = parser.parse_args()

    print_banner()

    loader = unittest.TestLoader()
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)

    import test_tier1_features
    import test_tier2_boundaries
    import test_tier3_combinations
    import test_tier4_workloads

    tier_modules = {
        "Tier 1": test_tier1_features,
        "Tier 2": test_tier2_boundaries,
        "Tier 3": test_tier3_combinations,
        "Tier 4": test_tier4_workloads,
    }

    selected_tiers = []
    if args.tier == "all":
        selected_tiers = ["Tier 1", "Tier 2", "Tier 3", "Tier 4"]
    else:
        selected_tiers = [f"Tier {args.tier}"]

    results_by_tier: Dict[str, Dict[str, int]] = {}
    t_start_global = time.perf_counter()
    all_success = True

    for t_name in selected_tiers:
        mod = tier_modules[t_name]
        suite = loader.loadTestsFromModule(mod)
        print(f"{CYAN}{BOLD}>> Running {t_name}...{RESET}")

        runner = ColorizedTestRunner(verbosity=2 if args.verbose else 1)
        res = runner.run(suite)

        results_by_tier[t_name] = {
            "runs": res.testsRun,
            "fails": len(res.failures),
            "errs": len(res.errors),
        }

        if not res.wasSuccessful():
            all_success = False

    t_elapsed_global = time.perf_counter() - t_start_global
    print_summary_table(results_by_tier, t_elapsed_global)

    sys.exit(0 if all_success else 1)


if __name__ == "__main__":
    main()
