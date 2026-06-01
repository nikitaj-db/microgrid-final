module.exports = (sequelize, DataTypes) => {
  const GensetTransducer = sequelize.define(
    "genset_transducer",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      frequency: {
        type: DataTypes.STRING,
      },
      kwh: {
        type: DataTypes.INTEGER,
      },
      power_factor: {
        type: DataTypes.STRING,
      },
      critical_load: {
        type: DataTypes.STRING,
      },
      non_critical_load: {
        type: DataTypes.STRING,
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
  return GensetTransducer;
};
