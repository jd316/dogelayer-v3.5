import { expect } from 'chai';
import request from 'supertest';
import { app } from '../../src/app';
import { db } from '../../src/database';
import { ethers } from 'hardhat';
import { Knex } from 'knex';

// Define interface for count query result
interface CountResult {
  count: number;
}

describe('Backend API Tests', function() {
  before(async function() {
    // Setup test database
    await db.migrate.latest();
  });

  after(async function() {
    // Cleanup test database
    await db.migrate.rollback();
  });

  beforeEach(async function() {
    // Clear all tables before each test
    await db('transactions').truncate();
    await db('users').truncate();
  });

  describe('Deposit API', function() {
    it('should create new deposit request', async function() {
      const response = await request(app)
        .post('/api/v1/deposits')
        .send({
          amount: '100.0',
          userAddress: ethers.Wallet.createRandom().address
        });

      expect(response.status).to.equal(201);
      expect(response.body).to.have.property('depositAddress');
      expect(response.body.depositAddress).to.match(/^D[1-9A-HJ-NP-Za-km-z]{33}$/);
    });

    it('should reject invalid deposit amounts', async function() {
      const response = await request(app)
        .post('/api/v1/deposits')
        .send({
          amount: '0.5', // Below minimum
          userAddress: ethers.Wallet.createRandom().address
        });

      expect(response.status).to.equal(400);
      expect(response.body.error).to.include('minimum deposit');
    });
  });

  describe('Withdrawal API', function() {
    it('should create withdrawal request', async function() {
      const response = await request(app)
        .post('/api/v1/withdrawals')
        .send({
          amount: '100.0',
          dogecoinAddress: 'DBXu2kgc3xtvCUWFcxFE3r9hEYgmuaaCyD',
          userAddress: ethers.Wallet.createRandom().address
        });

      expect(response.status).to.equal(201);
      expect(response.body).to.have.property('withdrawalId');
    });

    it('should validate Dogecoin address', async function() {
      const response = await request(app)
        .post('/api/v1/withdrawals')
        .send({
          amount: '100.0',
          dogecoinAddress: 'invalid-address',
          userAddress: ethers.Wallet.createRandom().address
        });

      expect(response.status).to.equal(400);
      expect(response.body.error).to.include('invalid Dogecoin address');
    });
  });

  describe('Transaction Status API', function() {
    it('should return transaction status', async function() {
      // First create a transaction
      const txId = await db('transactions').insert({
        type: 'deposit',
        status: 'pending',
        amount: '100.0',
        user_address: ethers.Wallet.createRandom().address,
        created_at: new Date()
      }).returning('id');

      const response = await request(app)
        .get(`/api/v1/transactions/${txId}`)
        .send();

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('status', 'pending');
    });

    it('should handle non-existent transactions', async function() {
      const response = await request(app)
        .get('/api/v1/transactions/999999')
        .send();

      expect(response.status).to.equal(404);
    });
  });

  describe('User Balance API', function() {
    it('should return user balance', async function() {
      const userAddress = ethers.Wallet.createRandom().address;
      
      // Create some transactions for the user
      await db('transactions').insert([
        {
          type: 'deposit',
          status: 'completed',
          amount: '100.0',
          user_address: userAddress,
          created_at: new Date()
        },
        {
          type: 'withdrawal',
          status: 'completed',
          amount: '50.0',
          user_address: userAddress,
          created_at: new Date()
        }
      ]);

      const response = await request(app)
        .get(`/api/v1/users/${userAddress}/balance`)
        .send();

      expect(response.status).to.equal(200);
      expect(response.body.balance).to.equal('50.0');
    });
  });

  describe('Rate Limiting', function() {
    it('should enforce rate limits', async function() {
      const userAddress = ethers.Wallet.createRandom().address;
      
      // Make multiple requests quickly
      const promises = Array(11).fill(0).map(() => 
        request(app)
          .post('/api/v1/deposits')
          .send({
            amount: '100.0',
            userAddress
          })
      );

      const responses = await Promise.all(promises);
      
      // At least one should be rate limited
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).to.be.true;
    });
  });

  describe('Database Operations', function() {
    it('should handle concurrent transactions', async function() {
      const userAddress = ethers.Wallet.createRandom().address;
      
      // Simulate concurrent deposits
      const promises = Array(5).fill(0).map(() => 
        db.transaction(async (trx) => {
          await trx('transactions').insert({
            type: 'deposit',
            status: 'pending',
            amount: '100.0',
            user_address: userAddress,
            created_at: new Date()
          });
        })
      );

      await Promise.all(promises);
      
      // Check that all transactions were recorded
      const result = await db('transactions').count('* as count').first();
      expect(result?.count as number).to.equal(5);
    });

    it('should maintain ACID properties', async function() {
      const userAddress = ethers.Wallet.createRandom().address;
      
      try {
        await db.transaction(async (trx) => {
          await trx('transactions').insert({
            type: 'deposit',
            status: 'pending',
            amount: '100.0',
            user_address: userAddress,
            created_at: new Date()
          });

          // This should cause the transaction to roll back
          throw new Error('Simulated error');
        });
      } catch (error) {
        // Error expected
      }

      // Check that no transaction was recorded
      const result = await db('transactions').count('* as count').first();
      expect(result?.count as number).to.equal(0);
    });
  });
}); 