module.exports = (sequelize, DataTypes) => {
  const SolarController = sequelize.define(
    "solar_controller",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      breaker_status: {
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
  return SolarController;
};
