CREATE DATABASE IF NOT EXISTS BuildSmarts
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;

USE BuildSmarts;

CREATE TABLE clientes (
    idCliente INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(150) NOT NULL,
    Correo VARCHAR(100),
    Telefono VARCHAR(50)
);

CREATE TABLE proyectos (
    idProyecto INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(150) NOT NULL,
    idCliente INT,
    FOREIGN KEY (idCliente) REFERENCES clientes(idCliente)
);

CREATE TABLE empleados (
    idEmpleado INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(120) NOT NULL,
    Correo VARCHAR(120),
    Telefono VARCHAR(50),
    Asistencia VARCHAR(20),
    Especialidad VARCHAR(120),
    foto_url VARCHAR(255),
    idProyecto INT,
    FOREIGN KEY (idProyecto) REFERENCES proyectos(idProyecto)
);

CREATE TABLE usuarios (
    idUsuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre_usuario VARCHAR(50) UNIQUE NOT NULL,
    contraseña VARCHAR(255) NOT NULL,
    rol ENUM('Administrador', 'Contador', 'Empleado') NOT NULL,
    idEmpleado INT,
    foto_url VARCHAR(255),
    Correo VARCHAR(120),
    FOREIGN KEY (idEmpleado) REFERENCES empleados(idEmpleado)
);

CREATE TABLE apartamentos (
    idApartamento INT AUTO_INCREMENT PRIMARY KEY,
    num_apartamento INT NOT NULL,
    num_piso INT NOT NULL,
    estado ENUM('Disponible', 'Ocupado', 'En mantenimiento') DEFAULT 'Disponible',
    idProyecto INT,
    FOREIGN KEY (idProyecto) REFERENCES proyectos(idProyecto)
);

CREATE TABLE pisos (
    idPiso INT AUTO_INCREMENT PRIMARY KEY,
    idProyecto INT,
    numero INT NOT NULL,
    idApartamento INT,
    FOREIGN KEY (idApartamento) REFERENCES apartamentos(idApartamento),
    FOREIGN KEY (idProyecto) REFERENCES proyectos(idProyecto)
);

CREATE TABLE materials (
    idMaterial INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(120) NOT NULL,
    costo_unitario DECIMAL(12,2) NOT NULL,
    tipo VARCHAR(60),
    foto_url VARCHAR(255)
);

CREATE TABLE turnos (
    idTurno INT AUTO_INCREMENT PRIMARY KEY,
    Hora_inicio TIME NOT NULL,
    Hora_fin TIME NOT NULL,
    Tipo_jornada VARCHAR(50),
    idEmpleado INT,
    FOREIGN KEY (idEmpleado) REFERENCES empleados(idEmpleado)
);

CREATE TABLE tareas (
    idTarea INT AUTO_INCREMENT PRIMARY KEY,
    Descripcion VARCHAR(250),
    Estado VARCHAR(50),
    idProyecto INT,
    idEmpleado INT,
    FOREIGN KEY (idProyecto) REFERENCES proyectos(idProyecto),
    FOREIGN KEY (idEmpleado) REFERENCES empleados(idEmpleado)
);

CREATE TABLE inventarios (
    idInventario INT AUTO_INCREMENT PRIMARY KEY,
    tipo_movimiento VARCHAR(30),
    cantidad INT NOT NULL,
    fecha DATE NOT NULL,
    idMaterial INT,
    idProyecto INT,
    FOREIGN KEY (idMaterial) REFERENCES materials(idMaterial),
    FOREIGN KEY (idProyecto) REFERENCES proyectos(idProyecto)
);

CREATE TABLE ingresos (
    idIngreso INT AUTO_INCREMENT PRIMARY KEY,
    fecha DATE NOT NULL,
    Valor DECIMAL(12,2) NOT NULL,
    Descripcion TEXT,
    idProyecto INT,
    FOREIGN KEY (idProyecto) REFERENCES proyectos(idProyecto)
);

CREATE TABLE gastos (
    idGasto INT AUTO_INCREMENT PRIMARY KEY,
    Valor DECIMAL(12,2) NOT NULL,
    Descripcion TEXT,
    fecha DATE NOT NULL,
    idProyecto INT,
    FOREIGN KEY (idProyecto) REFERENCES proyectos(idProyecto)
);

CREATE TABLE facturas (
    idFactura INT AUTO_INCREMENT PRIMARY KEY,
    Fecha DATE NOT NULL,
    Valor_total DECIMAL(12,2) NOT NULL,
    idProyecto INT,
    idCliente INT,
    FOREIGN KEY (idProyecto) REFERENCES proyectos(idProyecto),
    FOREIGN KEY (idCliente) REFERENCES clientes(idCliente)
);

CREATE TABLE pagos (
    idPago INT AUTO_INCREMENT PRIMARY KEY,
    Fecha DATE NOT NULL,
    Monto DECIMAL(12,2) NOT NULL,
    idFactura INT,
    FOREIGN KEY (idFactura) REFERENCES facturas(idFactura)
);
