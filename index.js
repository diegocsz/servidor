
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

app.use(express.json());
app.use(cors());

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'diego',
    database: 'bdtransito'
});

db.connect((err) => {
    if (err) {
        console.error('Error conectando a la base de datos:', err);
        return;
    }

    console.log('Conexión a la base de datos exitosa.');
});


app.get('/vehiculo/:nropla', (req, res) => {
    const { nropla } = req.params;

    const query = `
        SELECT
            v.NROPLA AS placa,
            v.NOMPRO AS propietario,
            v.MODELO AS modelo,
            p.NROPAP AS papeleta,
            i.INFDES AS infraccion,
            p.PAPFECHA AS fecha,
            i.INFIMP AS multa
        FROM VEHICULO v
        LEFT JOIN PAPELETA p
            ON v.NROPLA = p.NROPLA
        LEFT JOIN INFRACCION i
            ON p.INFCOD = i.INFCOD
        WHERE v.NROPLA = ?
        ORDER BY p.PAPFECHA, p.NROPAP;
    `;

    db.query(query, [nropla], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                error: 'Error consultando las papeletas del vehículo'
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                error: 'Vehículo no encontrado'
            });
        }

        const vehiculo = {
            placa: results[0].placa,
            propietario: results[0].propietario,
            modelo: results[0].modelo
        };

        const papeletas = results
            .filter(fila => fila.papeleta !== null)
            .map(fila => ({
                numero: fila.papeleta,
                infraccion: fila.infraccion,
                fecha: fila.fecha,
                multa: Number(fila.multa)
            }));

        const totalMultas = papeletas.reduce(
            (total, papeleta) => total + papeleta.multa,
            0
        );

        res.json({
            vehiculo,
            papeletas,
            total_multas: totalMultas
        });
    });
});


app.get('/multas/:anio', (req, res) => {
    const { anio } = req.params;

    if (!/^\d{4}$/.test(anio)) {
        return res.status(400).json({
            error: 'Ingrese un año válido'
        });
    }

    const query = `
        SELECT
            v.NROPLA AS placa,
            v.NOMPRO AS propietario,
            COUNT(p.NROPAP) AS cantidad_papeletas,
            COALESCE(SUM(i.INFIMP), 0) AS monto
        FROM VEHICULO v
        JOIN PAPELETA p
            ON v.NROPLA = p.NROPLA
        JOIN INFRACCION i
            ON p.INFCOD = i.INFCOD
        WHERE YEAR(p.PAPFECHA) = ?
        GROUP BY
            v.NROPLA,
            v.NOMPRO
        ORDER BY v.NROPLA;
    `;

    db.query(query, [anio], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                error: 'Error consultando las papeletas del año'
            });
        }

        res.json({
            anio: Number(anio),
            vehiculos: results.map(fila => ({
                placa: fila.placa,
                propietario: fila.propietario,
                cantidad_papeletas: Number(fila.cantidad_papeletas),
                monto: Number(fila.monto)
            }))
        });
    });
});


app.post('/papeletas', (req, res) => {
    const { placa, codinf, poli } = req.body;

    const query = `
        CALL spadicion(?, ?, ?);
    `;

    db.query(query, [placa, codinf, poli], (err, results) => {
        if (err) {
            console.error(err);

            return res.status(500).json({
                error: 'Error registrando la papeleta'
            });
        }

        res.status(201).json({
            mensaje: 'Papeleta registrada correctamente'
        });
    });
});


const PORT = 3307;

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
