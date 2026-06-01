module.exports = (sequelize, DataTypes) => {
  const Mains = sequelize.define(
    "main",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      breaker_status: {
        type: DataTypes.STRING,
      },
      frequency: {
        type: DataTypes.STRING,
      },
      operating_hours: {
        type: DataTypes.STRING,
      },
      power_factor: {
        type: DataTypes.STRING,
      },
      hours_operated: {
        type: DataTypes.STRING,
      },
      kwh: {
        type: DataTypes.INTEGER,
      },
      unit_generated: {
        type: DataTypes.INTEGER,
      },
      kw_phase1: {
        type: DataTypes.DECIMAL(10, 2),
      },
      kw_phase2: {
        type: DataTypes.DECIMAL(10, 2),
      },
      kw_phase3: {
        type: DataTypes.DECIMAL(10, 2),
      },
      kva_phase1: {
        type: DataTypes.DECIMAL(10, 2),
      },
      kva_phase2: {
        type: DataTypes.DECIMAL(10, 2),
      },
      kva_phase3: {
        type: DataTypes.DECIMAL(10, 2),
      },
      current_phase1: {
        type: DataTypes.DECIMAL(10, 2),
      },
      current_phase2: {
        type: DataTypes.DECIMAL(10, 2),
      },
      current_phase3: {
        type: DataTypes.DECIMAL(10, 2),
      },
      voltagel_phase1: {
        type: DataTypes.DECIMAL(10, 2),
      },
      voltagel_phase2: {
        type: DataTypes.DECIMAL(10, 2),
      },
      voltagel_phase3: {
        type: DataTypes.DECIMAL(10, 2),
      },
      voltagen_phase1: {
        type: DataTypes.DECIMAL(10, 2),
      },
      voltagen_phase2: {
        type: DataTypes.DECIMAL(10, 2),
      },
      voltagen_phase3: {
        type: DataTypes.DECIMAL(10, 2),
      },
      // data_sent: {
      //   type: DataTypes.BOOLEAN,
      //   defaultValue: false,
      // },
    },
    {
      freezeTableName: true,
      timestamps: true,
    }
  );
  return Mains;
};
