module.exports = (sequelize, DataTypes) => {
  const GensetController = sequelize.define(
    "genset_controller",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      coolant_temp: {
        type: DataTypes.STRING,
      },
      battery_charged: {
        type: DataTypes.STRING,
      },
      oil_pressure: {
        type: DataTypes.STRING,
      },
      hours_operated_yesterday: {
        type: DataTypes.STRING,
      },
      power_factor: {
        type: DataTypes.STRING,
      },
      fuel_level: {
        type: DataTypes.STRING,
      },
      operating_hours: {
        type: DataTypes.STRING,
      },
      unit_generated: {
        type: DataTypes.INTEGER,
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
  return GensetController;
};
