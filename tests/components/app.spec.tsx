// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App";
import { getApi } from "../../src/api";
import { seedDemoTrades } from "../../src/mockApi";

beforeEach(() => {
  localStorage.clear();
});

describe("App (jsdom, mock API)", () => {
  it("shows journal cards first, then the dashboard of the clicked journal", async () => {
    await seedDemoTrades(getApi(), 12);
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    // first screen = journal picker with a card
    const card = await screen.findByTestId("journal-card");
    expect(screen.getByTestId("journals-page")).toBeInTheDocument();
    expect(screen.getByTestId("journal-card-name").textContent).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("journal-stat-count").textContent).toBe("14")); // 12 closed + 2 open
    // click the card -> dashboard of that journal
    const user = userEvent.setup();
    await user.click(card);
    await waitFor(() => expect(screen.getByTestId("stat-net-pnl")).toBeInTheDocument());
    // 12 closed + 2 open seeded
    expect(screen.getByTestId("stat-win-rate").textContent).toMatch(/%/);
    expect(screen.getByTestId("equity-chart")).toBeInTheDocument();
    expect(screen.getByTestId("heatmap")).toBeInTheDocument();
    expect(screen.getByTestId("table-setup")).toBeInTheDocument();
    expect(screen.getByTestId("open-trades-banner")).toBeInTheDocument();
  });

  it("creates a trade through the form and shows it in the list", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/trades/new"]}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId("field-symbol")).toBeInTheDocument());
    await user.clear(screen.getByTestId("field-symbol"));
    await user.type(screen.getByTestId("field-symbol"), "BTC/USDT");
    await user.clear(screen.getByTestId("field-entry-price"));
    await user.type(screen.getByTestId("field-entry-price"), "67000");
    await user.clear(screen.getByTestId("field-sl"));
    await user.type(screen.getByTestId("field-sl"), "66000");
    await user.clear(screen.getByTestId("field-tp1"));
    await user.type(screen.getByTestId("field-tp1"), "69000");
    await user.clear(screen.getByTestId("field-quantity"));
    await user.type(screen.getByTestId("field-quantity"), "0.1");
    // live calc panel shows notional 6700 and planned RR 2:1
    expect(screen.getByTestId("calc-notional").textContent).toContain("6,700");
    expect(screen.getByTestId("calc-rr").textContent).toContain("2.00");
    await user.click(screen.getByTestId("btn-save-trade"));
    await waitFor(async () => {
      const trades = await getApi().listTrades();
      expect(trades).toHaveLength(1);
      expect(trades[0].symbol).toBe("BTC/USDT");
      expect(trades[0].status).toBe("open");
    });
  });

  it("shows a validation error when required fields are missing", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/trades/new"]}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId("btn-save-trade")).toBeInTheDocument());
    await user.click(screen.getByTestId("btn-save-trade"));
    expect(await screen.findByText("نماد را وارد کن (مثلاً BTC/USDT)")).toBeInTheDocument();
    expect(await getApi().listTrades()).toHaveLength(0);
  });
});
