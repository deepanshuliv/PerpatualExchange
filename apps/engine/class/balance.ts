import type { User } from "@repo/shared-types/internal-types";

export default class Balance {
  private user: User;
  constructor() {
    this.user = {};
  }

  createSnapShot() {
    return JSON.stringify(this.user);
  }

  loadSnapShot(balanceSnapShot: string) {
    if (!balanceSnapShot) return;
    this.user = JSON.parse(balanceSnapShot || '{}');
    for (const userId of Object.keys(this.user)) {
      const account = this.user[userId];
      if (!account) continue;
      if (account.balance < 0) {
        account.balance = 0;
      }
      if (account.lockedBalance < 0) {
        account.lockedBalance = 0;
      }
    }
  }

  createUserBalanceAccount(userId: string) {
    if (!this.user[userId]) {
      this.user[userId] = {
        // New accounts should start at 0; funding happens via explicit onramp/add_balance.
        balance: 0,
        lockedBalance: 0,
      };
    }
    return this.user[userId];
  }

  getBalance(userId: string) {
    if (!this.user[userId]) {
      return null;
    }

    return this.user[userId].balance;
  }

  updateBalance(userId: string, signedAmount: number) {
    if (!this.user[userId]) {
      return null;
    }
    this.user[userId].balance += signedAmount;
    if (this.user[userId].balance < 0) {
      this.user[userId].balance = 0;
    }
  }

  addBalance(userId: string, amount: number) {
    if (!this.user[userId]) {
      this.createUserBalanceAccount(userId);
    }
    const account = this.user[userId]!;
    const delta = Number(amount);
    if (!Number.isFinite(delta) || delta <= 0) {
      return account.balance;
    }
    account.balance += delta;
    if (account.balance < 0) {
      account.balance = 0;
    }
    return account.balance;
  }

  updateLockedBalance(userId: string, signedAmount: number) {
    if (!this.user[userId]) {
      return null;
    }
    this.user[userId].lockedBalance += signedAmount;
    if (this.user[userId].lockedBalance < 0) {
      this.user[userId].lockedBalance = 0;
    }
  }
}
