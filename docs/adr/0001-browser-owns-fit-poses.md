# Browser owns fitted robot poses

The GLB will provide the robot's appearance and named articulated hierarchy, while browser code derives sitting, standing, and transition poses from the current body and workstation measurements. A baked sit-to-stand animation was rejected because fixed hand, hip, knee, and foot paths would not remain aligned when the user's height or calibrated furniture heights change.
