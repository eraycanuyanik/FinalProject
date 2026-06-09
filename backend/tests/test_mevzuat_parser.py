"""Faz 4: kanun maddesi parçalama testi (PDF gerektirmez)."""
from app.services.mevzuat_parser import split_articles_from_text

SAMPLE = """Bazı giriş metni.

1. Genel hüküm
MADDE 1- Bu Kanunun amacı sözleşme ilişkilerini düzenlemektir.

2. Kapsam
MADDE 2- Bu Kanun gerçek ve tüzel kişileri kapsar. İkinci fıkra burada.

GEÇİCİ MADDE 1- Yürürlükten önceki ilişkilere uygulanmaz.
"""


def test_split_articles():
    arts = split_articles_from_text(SAMPLE, 6098, "Türk Borçlar Kanunu")
    assert len(arts) == 3
    assert arts[0].madde_no == "1"
    assert arts[1].madde_no == "2"
    assert arts[2].madde_no == "Geçici 1"
    assert arts[0].kanun_no == 6098
    assert "amacı" in arts[0].text
