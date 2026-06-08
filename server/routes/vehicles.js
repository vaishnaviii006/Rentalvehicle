import express from 'express';
import Vehicle from '../models/Vehicle.js';
import { isDbConnected, getVehicles, addVehicle, updateVehicle } from '../memoryDb.js';

const router = express.Router();

// GET all vehicles
router.get('/', async (req, res) => {
  try {
    if (isDbConnected()) {
      const vehicles = await Vehicle.find().sort({ createdAt: -1 });
      res.json(vehicles);
    } else {
      res.json(getVehicles().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET single vehicle
router.get('/:vehicleId', async (req, res) => {
  try {
    if (isDbConnected()) {
      const vehicle = await Vehicle.findOne({ vehicleId: req.params.vehicleId });
      if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
      res.json(vehicle);
    } else {
      const vehicle = getVehicles().find(v => v.vehicleId === req.params.vehicleId);
      if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
      res.json(vehicle);
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST create vehicle
router.post('/', async (req, res) => {
  try {
    if (isDbConnected()) {
      // Force status compatibilities if needed
      const payload = { ...req.body };
      if (!payload.assignedWorker && payload.assignedWorker !== '') {
        payload.assignedWorker = 'Unassigned';
      }
      const vehicle = new Vehicle(payload);
      const newVehicle = await vehicle.save();
      res.status(201).json(newVehicle);
    } else {
      const newVehicle = addVehicle(req.body);
      res.status(201).json(newVehicle);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT update vehicle
router.put('/:vehicleId', async (req, res) => {
  try {
    if (isDbConnected()) {
      const vehicle = await Vehicle.findOne({ vehicleId: req.params.vehicleId });
      if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

      // Merge body properties dynamically
      Object.assign(vehicle, req.body);
      const updatedVehicle = await vehicle.save();
      res.json(updatedVehicle);
    } else {
      const updatedVehicle = updateVehicle(req.params.vehicleId, req.body);
      if (!updatedVehicle) return res.status(404).json({ message: 'Vehicle not found' });
      res.json(updatedVehicle);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PATCH toggle vehicle status (Available / Maintenance)
router.patch('/:vehicleId/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (isDbConnected()) {
      const vehicle = await Vehicle.findOne({ vehicleId: req.params.vehicleId });
      if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

      vehicle.status = status;
      // Sync availability reason if set
      if (req.body.reason) {
        vehicle.availability = {
          availableForBooking: status === 'Active' || status === 'Available',
          reason: req.body.reason
        };
      }
      const updatedVehicle = await vehicle.save();
      res.json(updatedVehicle);
    } else {
      const updateData = { status };
      if (req.body.reason) {
        updateData.availability = {
          availableForBooking: status === 'Active' || status === 'Available',
          reason: req.body.reason
        };
      }
      const updatedVehicle = updateVehicle(req.params.vehicleId, updateData);
      if (!updatedVehicle) return res.status(404).json({ message: 'Vehicle not found' });
      res.json(updatedVehicle);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE vehicle
router.delete('/:vehicleId', async (req, res) => {
  try {
    if (isDbConnected()) {
      const result = await Vehicle.deleteOne({ vehicleId: req.params.vehicleId });
      if (result.deletedCount === 0) return res.status(404).json({ message: 'Vehicle not found' });
      res.json({ message: 'Vehicle deleted successfully' });
    } else {
      const idx = getVehicles().findIndex(v => v.vehicleId === req.params.vehicleId);
      if (idx === -1) return res.status(404).json({ message: 'Vehicle not found' });
      getVehicles().splice(idx, 1);
      res.json({ message: 'Vehicle deleted successfully' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
