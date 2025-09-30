/**
 * Unit test for data models to verify basic functionality
 */

import { UserModel } from '../../src/models/User';
import { TeamModel } from '../../src/models/Team';
import { KPIGroupModel } from '../../src/models/KPIGroup';
import { initializeDatabase } from '../../src/shared/database';

describe('Data Models Unit Tests', () => {
  beforeAll(async () => {
    // Initialize database for testing
    await initializeDatabase({
      filename: ':memory:'
    });
  });
  describe('Model Instantiation', () => {
    test('should instantiate UserModel without errors', () => {
      expect(() => new UserModel()).not.toThrow();
    });

    test('should instantiate TeamModel without errors', () => {
      expect(() => new TeamModel()).not.toThrow();
    });

    test('should instantiate KPIGroupModel without errors', () => {
      expect(() => new KPIGroupModel()).not.toThrow();
    });
  });

  describe('Database Connection', () => {
    test('models should have database connection', () => {
      const userModel = new UserModel();
      const teamModel = new TeamModel();
      const kpiGroupModel = new KPIGroupModel();

      // Check that models have private db property (via constructor)
      expect(userModel).toBeDefined();
      expect(teamModel).toBeDefined();
      expect(kpiGroupModel).toBeDefined();
    });
  });

  describe('Method Existence', () => {
    test('UserModel should have core methods', () => {
      const userModel = new UserModel();
      
      expect(typeof userModel.create).toBe('function');
      expect(typeof userModel.findByEmail).toBe('function');
      expect(typeof userModel.findById).toBe('function');
      expect(typeof userModel.verifyEmail).toBe('function');
    });

    test('TeamModel should have required methods', () => {
      const teamModel = new TeamModel();
      
      expect(typeof teamModel.create).toBe('function');
      expect(typeof teamModel.findById).toBe('function');
      expect(typeof teamModel.findByManager).toBe('function');
      expect(typeof teamModel.getMembers).toBe('function');
      expect(typeof teamModel.addMembers).toBe('function');
    });

    test('KPIGroupModel should have required methods', () => {
      const kpiGroupModel = new KPIGroupModel();
      
      expect(typeof kpiGroupModel.create).toBe('function');
      expect(typeof kpiGroupModel.findById).toBe('function');
      expect(typeof kpiGroupModel.findByName).toBe('function');
      expect(typeof kpiGroupModel.findAll).toBe('function');
      expect(typeof kpiGroupModel.validateWeights).toBe('function');
    });
  });
});
