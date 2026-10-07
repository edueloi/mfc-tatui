// Rotas de APIs externas (CEP e localidades)

const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

// Buscar endereço por CEP usando ViaCEP
router.get('/cep/:cep', async (req, res) => {
  try {
    const { cep } = req.params;
    const cepLimpo = cep.replace(/\D/g, '');
    
    if (cepLimpo.length !== 8) {
      return res.status(400).json({ error: 'CEP inválido' });
    }

    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, { timeout: 7000 });
    if (!response.ok) throw new Error('Serviço de CEP indisponível');
    const data = await response.json();

    if (data.erro) {
      return res.status(404).json({ error: 'CEP não encontrado' });
    }

    res.json({
      cep: data.cep,
      logradouro: data.logradouro || '',
      complemento: data.complemento || '',
      bairro: data.bairro || '',
      localidade: data.localidade,
      uf: data.uf,
      ibge: data.ibge
    });
  } catch (error) {
    console.error('Erro ao buscar CEP:', error);
    res.status(503).json({ error: 'A consulta de CEP está indisponível no momento.' });
  }
});

// Listar todos os estados do Brasil
router.get('/estados', async (req, res) => {
  try {
    const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
    const data = await response.json();

    const estados = data.map(estado => ({
      id: estado.id,
      sigla: estado.sigla,
      nome: estado.nome
    }));

    res.json(estados);
  } catch (error) {
    console.error('Erro ao buscar estados:', error);
    res.status(500).json({ error: 'Erro ao buscar estados' });
  }
});

// Listar cidades de um estado específico
router.get('/estados/:uf/cidades', async (req, res) => {
  try {
    const { uf } = req.params;
    const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
    const data = await response.json();

    const cidades = data.map(cidade => ({
      id: cidade.id,
      nome: cidade.nome
    }));

    res.json(cidades);
  } catch (error) {
    console.error('Erro ao buscar cidades:', error);
    res.status(500).json({ error: 'Erro ao buscar cidades' });
  }
});

// Buscar todas as cidades do Brasil (use com cautela, são ~5570 cidades)
router.get('/cidades', async (req, res) => {
  try {
    const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome');
    const data = await response.json();

    const cidades = data.map(cidade => ({
      id: cidade.id,
      nome: cidade.nome,
      uf: cidade.microrregiao.mesorregiao.UF.sigla
    }));

    res.json(cidades);
  } catch (error) {
    console.error('Erro ao buscar cidades:', error);
    res.status(500).json({ error: 'Erro ao buscar cidades' });
  }
});

module.exports = router;
