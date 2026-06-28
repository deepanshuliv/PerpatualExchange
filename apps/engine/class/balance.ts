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
  }
  createUserBalanceAccount(userId: string) {
    let userAvailabel = this.user[userId];
    if (!userAvailabel) {
      userAvailabel = {
        balance: 1000,
        lockedBalance: 0,
      };
    }
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
  }

  addBalance(userId: string, amount: number) {
    if (!this.user[userId]) {
      return null;
    }
    this.user[userId].balance += amount;
  }
  updateLockedBalance(userId: string, signedAmount: number) {
    if (!this.user[userId]) {
      return null;
    }
    this.user[userId].lockedBalance += signedAmount;
  }

  addLockedBalance(userId: string, amount: number) {
    if (!this.user[userId]) {
      return null;
    }
    this.user[userId].lockedBalance += amount;
  }
  getLockedBalance(userId: string) {
    if (!this.user[userId]) {
      return null;
    }
    return this.user[userId].lockedBalance;
  }
}
