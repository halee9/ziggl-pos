import { describe, it, expect } from 'vitest';
import { canAccess, getVisibleNavPaths } from './roles';

describe('roles — /tasks access', () => {
  describe('canAccess', () => {
    it('allows manager to access /tasks', () => {
      expect(canAccess('manager', '/tasks')).toBe(true);
    });

    it('allows owner to access /tasks', () => {
      expect(canAccess('owner', '/tasks')).toBe(true);
    });

    it('denies staff from accessing /tasks', () => {
      expect(canAccess('staff', '/tasks')).toBe(false);
    });
  });

  describe('getVisibleNavPaths', () => {
    it('includes /tasks for manager', () => {
      expect(getVisibleNavPaths('manager')).toContain('/tasks');
    });

    it('includes /tasks for owner', () => {
      expect(getVisibleNavPaths('owner')).toContain('/tasks');
    });

    it('does not include /tasks for staff', () => {
      expect(getVisibleNavPaths('staff')).not.toContain('/tasks');
    });
  });
});
