-- Crear base de datos
CREATE DATABASE IF NOT EXISTS Proyecto
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;
USE Proyecto;

-- Tabla: cliente
CREATE TABLE cliente (
    idCliente INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(150) NOT NULL,
    Documento VARCHAR(50) NOT NULL UNIQUE,
    Telefono VARCHAR(50),
    Correo VARCHAR(120)
);

-- Tabla: proyecto
CREATE TABLE proyecto (
    idProyecto INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(150) NOT NULL,
    idCliente INT,
    FOREIGN KEY (idCliente) REFERENCES cliente(idCliente)
);

-- Tabla: apartamento
CREATE TABLE apartamento (
    idApartamento INT AUTO_INCREMENT PRIMARY KEY,
    num_apartamento INT NOT NULL,
    num_piso INT NOT NULL,
    estado ENUM('Disponible', 'Ocupado', 'En mantenimiento') DEFAULT 'Disponible',
    idProyecto INT,
    FOREIGN KEY (idProyecto) REFERENCES proyecto(idProyecto)
);

-- Tabla: piso
CREATE TABLE piso (
    idPiso INT AUTO_INCREMENT PRIMARY KEY,
    idProyecto INT,
    numero INT NOT NULL,
    idApartamento INT,
    FOREIGN KEY (idApartamento) REFERENCES apartamento(idApartamento),
    FOREIGN KEY (idProyecto) REFERENCES proyecto(idProyecto)
);

-- Tabla: material
CREATE TABLE material (
    idMaterial INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(120) NOT NULL,
    costo_unitario DECIMAL(12,2) NOT NULL,
    tipo VARCHAR(60)
);

-- Tabla: empleado
CREATE TABLE empleado (
    idEmpleado INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(120) NOT NULL,
    Correo VARCHAR(120),
    Telefono VARCHAR(50),
    Asistencia VARCHAR(20),
    Especialidad VARCHAR(120),
    idProyecto INT,
    FOREIGN KEY (idProyecto) REFERENCES proyecto(idProyecto)
);

-- Tabla: usuario (vinculado a empleado)
CREATE TABLE usuario (
    idUsuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre_usuario VARCHAR(50) UNIQUE NOT NULL,
    contraseña VARCHAR(255) NOT NULL,
    rol ENUM('Administrador', 'Contador', 'Empleado') NOT NULL,
    idEmpleado INT,
    FOREIGN KEY (idEmpleado) REFERENCES empleado(idEmpleado)
);

-- Tabla: turno
CREATE TABLE turno (
    idTurno INT AUTO_INCREMENT PRIMARY KEY,
    Hora_inicio TIME NOT NULL,
    Hora_fin TIME NOT NULL,
    Tipo_jornada VARCHAR(50),
    idEmpleado INT,
    FOREIGN KEY (idEmpleado) REFERENCES empleado(idEmpleado)
);

-- Tabla: tarea
CREATE TABLE tarea (
    idTarea INT AUTO_INCREMENT PRIMARY KEY,
    Descripcion VARCHAR(250),
    Estado VARCHAR(50),
    idProyecto INT,
    idEmpleado INT,
    FOREIGN KEY (idProyecto) REFERENCES proyecto(idProyecto),
    FOREIGN KEY (idEmpleado) REFERENCES empleado(idEmpleado)
);

-- Tabla: inventario
CREATE TABLE inventario (
    idInventario INT AUTO_INCREMENT PRIMARY KEY,
    tipo_movimiento VARCHAR(30),
    cantidad INT NOT NULL,
    fecha DATE NOT NULL,
    idMaterial INT,
    idProyecto INT,
    FOREIGN KEY (idMaterial) REFERENCES material(idMaterial),
    FOREIGN KEY (idProyecto) REFERENCES proyecto(idProyecto)
);

-- Tabla: ingreso
CREATE TABLE ingreso (
    idIngreso INT AUTO_INCREMENT PRIMARY KEY,
    fecha DATE NOT NULL,
    Valor DECIMAL(12,2) NOT NULL,
    Descripcion TEXT,
    idProyecto INT,
    FOREIGN KEY (idProyecto) REFERENCES proyecto(idProyecto)
);

-- Tabla: gasto
CREATE TABLE gasto (
    idGasto INT AUTO_INCREMENT PRIMARY KEY,
    Valor DECIMAL(12,2) NOT NULL,
    Descripcion TEXT,
    fecha DATE NOT NULL,
    idProyecto INT,
    FOREIGN KEY (idProyecto) REFERENCES proyecto(idProyecto)
);

-- Tabla: factura
CREATE TABLE factura (
    idFactura INT AUTO_INCREMENT PRIMARY KEY,
    Fecha DATE NOT NULL,
    Valor_total DECIMAL(12,2) NOT NULL,
    idProyecto INT,
    idCliente INT,
    FOREIGN KEY (idProyecto) REFERENCES proyecto(idProyecto),
    FOREIGN KEY (idCliente) REFERENCES cliente(idCliente)
);

-- Tabla: pago
CREATE TABLE pago (
    idPago INT AUTO_INCREMENT PRIMARY KEY,
    Fecha DATE NOT NULL,
    Monto DECIMAL(12,2) NOT NULL,
    idFactura INT,
    FOREIGN KEY (idFactura) REFERENCES factura(idFactura)
);
